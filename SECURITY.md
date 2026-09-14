# Security

## Reporting

Please don't open a public issue for a vulnerability. Report it privately through GitHub:

**https://github.com/extramoose/tooltip/security/advisories/new**

You'll get an acknowledgement within a few days and a fix or a reasoned "not a vulnerability" after that. Credit in the advisory and the changelog if you want it.

## Supported versions

The latest 1.x release. Fixes ship as a new patch version, published to npm from GitHub with provenance.

## What counts

This library renders the text it is given with `textContent`, never `innerHTML`, so `data-tip` and `data-tip-key` cannot inject markup. If you find a way they can, that's a vulnerability and I want to hear about it. The same goes for anything that lets one instance read or affect another page's DOM beyond the pill it owns.

It has no runtime dependencies. Build and test tooling are pinned and updated by Dependabot.
