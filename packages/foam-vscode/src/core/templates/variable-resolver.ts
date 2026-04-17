import { toSlug } from '../utils/slug';
import {
  SnippetParser,
  Variable,
  VariableResolver,
} from '../common/snippetParser';
import dayjs from 'dayjs';

const knownFoamVariables = new Set([
  'FOAM_TITLE',
  'FOAM_TITLE_SAFE',
  'FOAM_SLUG',
  'FOAM_SELECTED_TEXT',
  'FOAM_CURRENT_DIR',
  'FOAM_DATE_FORMAT',
  'FOAM_DATE_YEAR',
  'FOAM_DATE_YEAR_SHORT',
  'FOAM_DATE_MONTH',
  'FOAM_DATE_MONTH_NAME',
  'FOAM_DATE_MONTH_NAME_SHORT',
  'FOAM_DATE_DATE',
  'FOAM_DATE_DAY_ISO',
  'FOAM_DATE_WEEK',
  'FOAM_DATE_WEEK_YEAR',
  'FOAM_DATE_DAY_NAME',
  'FOAM_DATE_DAY_NAME_SHORT',
  'FOAM_DATE_HOUR',
  'FOAM_DATE_MINUTE',
  'FOAM_DATE_SECOND',
  'FOAM_DATE_SECONDS_UNIX',
]);

/**
 * Interface for resolving environment-specific variables.
 * Implement this for each host environment (VS Code, CLI, etc.).
 */
export interface VariableProvider {
  /** Obtain a note title interactively or from environment context. */
  resolveTitle(): Promise<string>;
  /** Return selected text in the current editor, or '' if not applicable. */
  resolveSelectedText(): string;
  /** Return the current working directory path. */
  resolveCurrentDir(): string;
}

export class Resolver implements VariableResolver {
  private promises = new Map<string, Promise<string | undefined>>();

  /**
   * @param givenValues pre-supplied variable values (e.g. FOAM_TITLE for daily notes)
   * @param foamDate date used for FOAM_DATE_* variables
   * @param foamTitle convenience shorthand for givenValues.set('FOAM_TITLE', ...)
   * @param locale locale string for date formatting, defaults to 'default'
   * @param variableProvider environment-specific provider for interactive variables
   */
  constructor(
    private givenValues: Map<string, string>,
    public foamDate: Date,
    foamTitle?: string,
    private locale: string = 'default',
    private variableProvider?: VariableProvider
  ) {
    if (foamTitle) {
      this.givenValues.set('FOAM_TITLE', foamTitle);
    }
  }

  define(name: string, value: string) {
    this.givenValues.set(name, value);
  }

  getVariables(): Record<string, string> {
    return Object.fromEntries(this.givenValues);
  }

  async resolveText(text: string): Promise<string> {
    let snippet = new SnippetParser().parse(text, false, false);
    let foamVariablesInTemplate = new Set(
      snippet
        .variables()
        .map(v => v.name)
        .filter(name => knownFoamVariables.has(name))
    );

    // Append FOAM_SELECTED_TEXT to the template if it was provided as a given
    // value but not already present in the template.
    if (
      this.givenValues.has('FOAM_SELECTED_TEXT') &&
      !foamVariablesInTemplate.has('FOAM_SELECTED_TEXT')
    ) {
      const token = '$FOAM_SELECTED_TEXT';
      text = text.endsWith('\n') ? `${text}${token}\n` : `${text}\n${token}`;
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
          value = this.variableProvider
            ? this.variableProvider.resolveTitle()
            : Promise.resolve(undefined);
          break;
        case 'FOAM_TITLE_SAFE':
          value = resolveFoamTitleSafe(this);
          break;
        case 'FOAM_SLUG':
          value = toSlug(await this.resolve(new Variable('FOAM_TITLE')));
          break;
        case 'FOAM_SELECTED_TEXT':
          value = Promise.resolve(
            this.variableProvider
              ? this.variableProvider.resolveSelectedText()
              : ''
          );
          break;
        case 'FOAM_CURRENT_DIR':
          value = Promise.resolve(
            this.variableProvider
              ? this.variableProvider.resolveCurrentDir()
              : undefined
          );
          break;
        case 'FOAM_DATE_FORMAT': {
          const fmt =
            variable.children.map(c => c.toString()).join('') ||
            'YYYY-MM-DDTHH:mm:ssZ';
          value = Promise.resolve(dayjs(this.foamDate).format(fmt));
          break;
        }
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
            this.foamDate.toLocaleString(this.locale, { month: 'long' })
          );
          break;
        case 'FOAM_DATE_MONTH_NAME_SHORT':
          value = Promise.resolve(
            this.foamDate.toLocaleString(this.locale, { month: 'short' })
          );
          break;
        case 'FOAM_DATE_DATE':
          value = Promise.resolve(
            String(this.foamDate.getDate().valueOf()).padStart(2, '0')
          );
          break;
        case 'FOAM_DATE_DAY_ISO':
          value = Promise.resolve(
            String(((this.foamDate.getDay() + 6) % 7) + 1)
          );
          break;
        case 'FOAM_DATE_WEEK': {
          const date = new Date(this.foamDate);
          date.setDate(date.getDate() + 4 - (date.getDay() || 7));
          const thursday = date.getTime();
          date.setMonth(0);
          date.setDate(1);
          const janFirst = date.getTime();
          const days = Math.round((thursday - janFirst) / 86400000);
          const weekDay = Math.floor(days / 7) + 1;
          value = Promise.resolve(String(weekDay.valueOf()).padStart(2, '0'));
          break;
        }
        case 'FOAM_DATE_WEEK_YEAR': {
          const date = new Date(this.foamDate);
          date.setDate(date.getDate() + 4 - (date.getDay() || 7));
          value = Promise.resolve(String(date.getFullYear()));
          break;
        }
        case 'FOAM_DATE_DAY_NAME':
          value = Promise.resolve(
            this.foamDate.toLocaleString(this.locale, { weekday: 'long' })
          );
          break;
        case 'FOAM_DATE_DAY_NAME_SHORT':
          value = Promise.resolve(
            this.foamDate.toLocaleString(this.locale, { weekday: 'short' })
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
    return this.promises.get(name);
  }
}

const UNALLOWED_CHARS = '/\\#%&{}<>?*$!\'":@+`|=';

export const resolveFoamTitleSafe = async (resolver: Resolver) => {
  let safeTitle = await resolver.resolveFromName('FOAM_TITLE');
  UNALLOWED_CHARS.split('').forEach(char => {
    safeTitle = safeTitle.split(char).join('-');
  });
  return safeTitle;
};
