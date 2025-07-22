import { findSelectionContent } from './editor';
import { window } from 'vscode';
import { UserCancelledOperation } from './errors';
import { toSlug } from '../utils/slug';
import {
  SnippetParser,
  Variable,
  VariableResolver,
} from '../core/common/snippetParser';

const knownFoamVariables = new Set([
  'FOAM_TITLE',
  'FOAM_TITLE_SAFE',
  'FOAM_SLUG',
  'FOAM_SELECTED_TEXT',
  'FOAM_DATE_YEAR',
  'FOAM_DATE_YEAR_SHORT',
  'FOAM_DATE_MONTH',
  'FOAM_DATE_MONTH_NAME',
  'FOAM_DATE_MONTH_NAME_SHORT',
  'FOAM_DATE_DATE',
  'FOAM_DATE_WEEK',
  'FOAM_DATE_DAY_NAME',
  'FOAM_DATE_DAY_NAME_SHORT',
  'FOAM_DATE_HOUR',
  'FOAM_DATE_MINUTE',
  'FOAM_DATE_SECOND',
  'FOAM_DATE_SECONDS_UNIX',
]);

export class Resolver implements VariableResolver {
  private promises = new Map<string, Promise<string | undefined>>();
  /**
   * Create a resolver
   *
   * @param givenValues the map of variable name to value
   * @param foamDate the date used to fill FOAM_DATE_* variables
   */
  constructor(
    private givenValues: Map<string, string>,
    public foamDate: Date
  ) {}

  /**
   * Adds a variable definition in the resolver
   *
   * @param name the name of the variable
   * @param value the value of the variable
   */
  define(name: string, value: string) {
    this.givenValues.set(name, value);
  }

  /**
   * Gets all defined variables as a plain object
   * Useful for passing to JavaScript templates that expect extraParams
   *
   * @returns Record containing all defined variables
   */
  getVariables(): Record<string, string> {
    return Object.fromEntries(this.givenValues);
  }

  /**
   * Process a string, replacing the variables with their values
   *
   * @param text the text to resolve
   * @returns an array, where the first element is the resolution map,
   *          and the second is the processed text
   */
  async resolveText(text: string): Promise<string> {
    let snippet = new SnippetParser().parse(text, false, false);
    let foamVariablesInTemplate = new Set(
      snippet
        .variables()
        .map(v => v.name)
        .filter(name => knownFoamVariables.has(name))
    );

    // Add FOAM_SELECTED_TEXT to the template text if required
    // and re-parse the template text.
    if (
      this.givenValues.has('FOAM_SELECTED_TEXT') &&
      !foamVariablesInTemplate.has('FOAM_SELECTED_TEXT')
    ) {
      const token = '$FOAM_SELECTED_TEXT';
      if (text.endsWith('\n')) {
        text = `${text}${token}\n`;
      } else {
        text = `${text}\n${token}`;
      }
      snippet = new SnippetParser().parse(text, false, false);
      foamVariablesInTemplate = new Set(
        snippet
          .variables()
          .map(v => v.name)
          .filter(name => knownFoamVariables.has(name))
      );
    }

    await snippet.resolveVariables(this, foamVariablesInTemplate);
    return snippet.snippetTextWithVariablesSubstituted(foamVariablesInTemplate);
  }

  /**
   * Resolves a list of variables
   *
   * @param variables a list of variables to resolve
   * @returns a Map of variable name to its value
   */
  async resolveAll(variables: Variable[]): Promise<Map<string, string>> {
    await Promise.all(variables.map(variable => variable.resolve(this)));

    const resolvedValues = new Map<string, string>();
    variables.forEach(variable => {
      if (variable.children.length > 0) {
        resolvedValues.set(variable.name, variable.toString());
      }
    });
    return resolvedValues;
  }

  /**
   * Resolve a variable
   *
   * @param name the variable name
   * @returns the resolved value, or the name of the variable if nothing is found
   */
  async resolveFromName(name: string): Promise<string> {
    const variable = new Variable(name);
    await variable.resolve(this);

    return (variable.children[0] ?? name).toString();
  }

  async resolve(variable: Variable): Promise<string | undefined> {
    const name = variable.name;
    if (this.givenValues.has(name)) {
      this.promises.set(name, Promise.resolve(this.givenValues.get(name)));
    } else if (!this.promises.has(name)) {
      let value: Promise<string | undefined> = Promise.resolve(undefined);
      switch (name) {
        case 'FOAM_TITLE':
          value = resolveFoamTitle();
          break;
        case 'FOAM_TITLE_SAFE':
          value = resolveFoamTitleSafe(this);
          break;
        case 'FOAM_SLUG':
          value = toSlug(await this.resolve(new Variable('FOAM_TITLE')));
          break;
        case 'FOAM_SELECTED_TEXT':
          value = Promise.resolve(resolveFoamSelectedText());
          break;
        case 'FOAM_DATE_YEAR':
          value = Promise.resolve(String(this.foamDate.getFullYear()));
          break;
        case 'FOAM_DATE_YEAR_SHORT':
          value = Promise.resolve(
            String(this.foamDate.getFullYear()).slice(-2)
          );
          break;
        case 'FOAM_DATE_MONTH':
          value = Promise.resolve(
            String(this.foamDate.getMonth().valueOf() + 1).padStart(2, '0')
          );
          break;
        case 'FOAM_DATE_MONTH_NAME':
          value = Promise.resolve(
            this.foamDate.toLocaleString('default', { month: 'long' })
          );
          break;
        case 'FOAM_DATE_MONTH_NAME_SHORT':
          value = Promise.resolve(
            this.foamDate.toLocaleString('default', { month: 'short' })
          );
          break;
        case 'FOAM_DATE_DATE':
          value = Promise.resolve(
            String(this.foamDate.getDate().valueOf()).padStart(2, '0')
          );
          break;
        case 'FOAM_DATE_WEEK': {
          // https://en.wikipedia.org/wiki/ISO_8601#Week_dates
          const date = new Date(this.foamDate);

          // Find Thursday of this week starting on Monday
          date.setDate(date.getDate() + 4 - (date.getDay() || 7));
          const thursday = date.getTime();

          // Find January 1st
          date.setMonth(0); // January
          date.setDate(1); // 1st
          const janFirst = date.getTime();

          // Round the amount of days to compensate for daylight saving time
          const days = Math.round((thursday - janFirst) / 86400000); // 1 day = 86400000 ms
          const weekDay = Math.floor(days / 7) + 1;
          value = Promise.resolve(String(weekDay.valueOf()).padStart(2, '0'));
          break;
        }
        case 'FOAM_DATE_DAY_NAME':
          value = Promise.resolve(
            this.foamDate.toLocaleString('default', { weekday: 'long' })
          );
          break;
        case 'FOAM_DATE_DAY_NAME_SHORT':
          value = Promise.resolve(
            this.foamDate.toLocaleString('default', { weekday: 'short' })
          );
          break;
        case 'FOAM_DATE_HOUR':
          value = Promise.resolve(
            String(this.foamDate.getHours().valueOf()).padStart(2, '0')
          );
          break;
        case 'FOAM_DATE_MINUTE':
          value = Promise.resolve(
            String(this.foamDate.getMinutes().valueOf()).padStart(2, '0')
          );
          break;
        case 'FOAM_DATE_SECOND':
          value = Promise.resolve(
            String(this.foamDate.getSeconds().valueOf()).padStart(2, '0')
          );
          break;
        case 'FOAM_DATE_SECONDS_UNIX':
          value = Promise.resolve(
            (this.foamDate.getTime() / 1000).toString().padStart(2, '0')
          );
          break;
        default:
          value = Promise.resolve(undefined);
          break;
      }
      this.promises.set(name, value);
    }
    const result = this.promises.get(name);
    return result;
  }
}

async function resolveFoamTitle() {
  const title = await window.showInputBox({
    prompt: `Enter a title for the new note`,
    value: 'Title of my New Note',
    validateInput: value =>
      value.trim().length === 0 ? 'Please enter a title' : undefined,
  });
  if (title === undefined) {
    throw new UserCancelledOperation('User did not provide a note title');
  }
  return title;
}

function resolveFoamSelectedText() {
  return findSelectionContent()?.content ?? '';
}

/**
 * Common chars that is better to avoid in file names.
 * Inspired by:
 *   https://www.mtu.edu/umc/services/websites/writing/characters-avoid/
 *   https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names
 * Even if some might be allowed in Win or Linux, to keep things more compatible and less error prone
 * we don't allow them
 * Also see https://github.com/foambubble/foam/issues/1042
 */
const UNALLOWED_CHARS = '/\\#%&{}<>?*$!\'":@+`|=';

/**
 * Uses the title to generate a file path.
 * It sanitizes the title to remove special characters and spaces.
 *
 * @param resolver the resolver to use
 * @returns the string path of the new note
 */
export const resolveFoamTitleSafe = async (resolver: Resolver) => {
  let safeTitle = await resolver.resolveFromName('FOAM_TITLE');
  UNALLOWED_CHARS.split('').forEach(char => {
    safeTitle = safeTitle.split(char).join('-');
  });
  return safeTitle;
};
