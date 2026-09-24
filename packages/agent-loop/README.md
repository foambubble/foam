# @foam/agent-loop

Implements the spec for the current branch in a loop: a coder session writes
and commits, the build, lint and test suite runs, and a reviewer session reads
the change against the spec. Up to three rounds, then a cold review of the
whole change for you.

```
yarn agent-loop [--rounds N] ["instructions"]
```

Run it from the repo root on a branch that has `specs/<slug>/spec.md` or
`specs.local/<slug>/spec.md`, where `<slug>` is the branch name minus its
prefix. The instructions are passed to the coder verbatim.

While it runs, type a line and press Enter to add feedback: it joins the next
round. Nothing is pushed or posted. The commits stay on the branch, and the
run's briefs, outputs, suite logs and summary are in
`.agent-loop/<slug>/<run>/`.

The spec is `specs/agent-loop/spec.md`.
