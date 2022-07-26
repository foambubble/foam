# Orphaned Notes

Foam helps you to find orphans: notes that have neither forward links nor backlinks.

Orphans can be found in the Orphans panel.

Two settings allows you to control the behaviour of the Orphans panel:

- `foam.orphans.exclude`: list of glob patterns that will be used to exclude directories. For example, a value of `["journal/**/*"]` would exclude your daily notes.
- `foam.orphans.groupBy`: sets the default view mode of the Orphans panel: either groups by folder (by default), or lists all orphans. The view can be toggled on the fly from the panel, but it won't overwrite the setting.
