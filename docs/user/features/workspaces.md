# Workspaces

It is possible to choose between two basic types of workspaces for the notes and templates:

  1. **"internal" VSCode workspace:** Watch and access the note and template folders within "internal" workspace (exclusive VSCode workspace)
  2. **"external" workspace:** Watch and access the note and template folders within "external" workspace ("external" with respect to VSCode workspace; INFO: this may include folders from the "internal" VSCode workspace)

The switch may be done via the config. property `foam.files.workspaceType` with possible values `[
            "internal",
            "external",
            "combined"
          ]`.

This feature allows to decouple the essential foam workspace from the VSCode workspace and provides better flexibility and less workflow complexity, particularly when working with multiple VSCode workspaces and projects.

The "external" and absolute note folder paths to be watched can be defined via the config. property 
`foam.files.externalWatchPaths` with the path to be set within an array.
The external and absolute template root directory path may be defined via the config. property `foam.files.externalTemplatesRoot` .   
 
**NOTE:** The "external" path definitions may be defined such that either only a respective root directory or, in addition, also a glob pattern is provided.