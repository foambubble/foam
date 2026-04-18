import { Resource } from '../../core/model/note';
import { URI } from '../../core/model/uri';
import {
  PublishContext,
  PublishedRoute,
  PublishedSite,
  PublishSiteContext,
  PublishValueResolver,
} from '../types';

const resolveValue = <TValue>(
  value: PublishValueResolver<TValue, PublishSiteContext> | undefined,
  context: PublishSiteContext
): TValue | undefined => {
  if (typeof value === 'function') {
    return value(context);
  }

  return value;
};

const resolveRouteFromString = (
  value: string,
  routes: PublishedRoute[]
): string | null => {
  const directRoute = routes.find(route => route.route === value);
  if (directRoute) {
    return directRoute.route;
  }

  const sourcePath = routes.find(route => route.sourceUri.path === value);
  return sourcePath?.route ?? null;
};

const resolveHomepageRoute = (
  context: PublishContext,
  notes: Resource[],
  routes: PublishedRoute[]
): string | null => {
  const siteContext: PublishSiteContext = {
    workspace: context.workspace,
    graph: context.graph,
    notes,
    routes,
  };

  if (!context.site?.homepage) {
    return routes.find(route => route.route === '/')?.route ?? routes[0]?.route ?? null;
  }

  const homepage = context.site.homepage;

  if (typeof homepage === 'string') {
    return resolveRouteFromString(homepage, routes);
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

export const buildPublishedSite = (
  context: PublishContext,
  notes: Resource[],
  routes: PublishedRoute[]
): PublishedSite => {
  const siteContext: PublishSiteContext = {
    workspace: context.workspace,
    graph: context.graph,
    notes,
    routes,
  };

  return {
    title: resolveValue(context.site?.title, siteContext),
    description: resolveValue(context.site?.description, siteContext),
    homepageRoute: resolveHomepageRoute(context, notes, routes),
  };
};
