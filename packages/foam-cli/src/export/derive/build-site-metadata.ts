import { Resource } from '@foam/core';
import { URI } from '@foam/core';
import {
  ExportContext,
  ExportedRoute,
  ExportedSite,
  ExportSiteContext,
  ExportValueResolver,
} from '../types';

const resolveValue = <TValue>(
  value: ExportValueResolver<TValue, ExportSiteContext> | undefined,
  context: ExportSiteContext
): TValue | undefined => {
  if (typeof value === 'function') {
    return (value as (context: ExportSiteContext) => TValue)(context);
  }

  return value;
};

const resolveRouteFromString = (
  context: ExportContext,
  value: string,
  routes: ExportedRoute[]
): string | null => {
  const directRoute = routes.find(route => route.route === value);
  if (directRoute) {
    return directRoute.route;
  }

  const candidatePaths = [
    value,
    context.workspace.resolveUri(value).path,
    context.contentRoot?.joinPath(value).path,
  ].filter((path): path is string => path !== undefined);

  const sourcePath = routes.find(route =>
    candidatePaths.includes(route.sourceUri.path)
  );
  return sourcePath?.route ?? null;
};

const resolveHomepageRoute = (
  context: ExportContext,
  notes: Resource[],
  routes: ExportedRoute[]
): string | null => {
  const siteContext: ExportSiteContext = {
    workspace: context.workspace,
    graph: context.graph,
    contentRoot: context.contentRoot,
    notes,
    routes,
  };

  if (!context.site?.homepage) {
    return routes.find(route => route.route === '/')?.route ?? routes[0]?.route ?? null;
  }

  const homepage = context.site.homepage;

  if (typeof homepage === 'string') {
    return resolveRouteFromString(context, homepage, routes);
  }

  if (homepage instanceof URI) {
    return context.noteRoutes.get(homepage.path) ?? null;
  }

  if (Resource.isResource(homepage)) {
    return context.noteRoutes.get(homepage.uri.path) ?? null;
  }

  const matchingNote = notes.find(note => homepage(note, siteContext));
  if (!matchingNote) {
    return null;
  }

  return context.noteRoutes.get(matchingNote.uri.path) ?? null;
};

export const buildExportedSite = (
  context: ExportContext,
  notes: Resource[],
  routes: ExportedRoute[]
): ExportedSite => {
  const siteContext: ExportSiteContext = {
    workspace: context.workspace,
    graph: context.graph,
    contentRoot: context.contentRoot,
    notes,
    routes,
  };

  return {
    title: resolveValue(context.site?.title, siteContext),
    description: resolveValue(context.site?.description, siteContext),
    homepageRoute: resolveHomepageRoute(context, notes, routes),
  };
};
