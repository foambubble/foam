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
  'FOAM_SLUG',
  'FOAM_SELECTED_TEXT',
  'FOAM_DATE_YEAR',
  'FOAM_DATE_YEAR_SHORT',
  'FOAM_DATE_MONTH',
  'FOAM_DATE_MONTH_NAME',
  'FOAM_DATE_MONTH_NAME_SHORT',
  'FOAM_DATE_DATE',
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
    private foamDate: Date
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
      switch (name) {
        case 'FOAM_TITLE':
          this.promises.set(name, resolveFoamTitle());
          break;
        case 'FOAM_SLUG':
          this.promises.set(
            name,
            Promise.resolve(
              toSlug(await this.resolve(new Variable('FOAM_TITLE')))
            )
          );
          break;
        case 'FOAM_SELECTED_TEXT':
          this.promises.set(name, Promise.resolve(resolveFoamSelectedText()));
          break;
        case 'FOAM_DATE_YEAR':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { year: 'numeric' })
            )
          );
          break;
        case 'FOAM_DATE_YEAR_SHORT':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { year: '2-digit' })
            )
          );
          break;
        case 'FOAM_DATE_MONTH':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { month: '2-digit' })
            )
          );
          break;
        case 'FOAM_DATE_MONTH_NAME':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { month: 'long' })
            )
          );
          break;
        case 'FOAM_DATE_MONTH_NAME_SHORT':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { month: 'short' })
            )
          );
          break;
        case 'FOAM_DATE_DATE':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { day: '2-digit' })
            )
          );
          break;
        case 'FOAM_DATE_DAY_NAME':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { weekday: 'long' })
            )
          );
          break;
        case 'FOAM_DATE_DAY_NAME_SHORT':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate.toLocaleString('default', { weekday: 'short' })
            )
          );
          break;
        case 'FOAM_DATE_HOUR':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate
                .toLocaleString('default', {
                  hour: '2-digit',
                  hour12: false,
                })
                .padStart(2, '0')
            )
          );
          break;
        case 'FOAM_DATE_MINUTE':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate
                .toLocaleString('default', {
                  minute: '2-digit',
                  hour12: false,
                })
                .padStart(2, '0')
            )
          );
          break;
        case 'FOAM_DATE_SECOND':
          this.promises.set(
            name,
            Promise.resolve(
              this.foamDate
                .toLocaleString('default', {
                  second: '2-digit',
                  hour12: false,
                })
                .padStart(2, '0')
            )
          );
          break;
        case 'FOAM_DATE_SECONDS_UNIX':
          this.promises.set(
            name,
            Promise.resolve(
              (this.foamDate.getTime() / 1000).toString().padStart(2, '0')
            )
          );
          break;
        default:
          this.promises.set(name, Promise.resolve(undefined));
          break;
      }
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
    throw new UserCancelledOperation();
  }
  return title;
}

function resolveFoamSelectedText() {
  return findSelectionContent()?.content ?? '';
}
