# Security policy

## Supported versions

Security fixes are made on the default branch and included in the next release.
Only the current default branch and the most recent tagged release are supported.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Latest tagged release | Yes |
| Older revisions and forks | No |

## Report a vulnerability privately

Use **Security → Report a vulnerability** in the
[Python EduGround repository](https://github.com/Juskocode/Python-EduGround/security)
when private vulnerability reporting is available. Include:

- the affected revision and deployment model;
- the vulnerable route, component, or trust boundary;
- minimal reproduction steps or a proof of concept;
- the realistic impact and required preconditions;
- any suggested mitigation.

Do not open a public issue containing exploit details, credentials, session tokens,
learner code, personal data, or database contents. If private reporting is not
available, open a public issue asking the maintainer to establish a private contact
channel without including vulnerability details.

The maintainer aims to acknowledge a complete report within three business days,
provide an initial triage within seven business days, and share a status update at
least every fourteen days until resolution. Timelines may vary with severity and
maintainer availability.

## Security boundaries

Reports are especially useful for:

- authentication, session handling, authorization, and account isolation;
- PostgreSQL persistence, migrations, backup, or data deletion;
- submission-file traversal, symlink, permission, or cross-user access;
- denial of service, input limits, sensitive error disclosure, or unsafe headers;
- browser-worker isolation or unintended access outside the exercise runner;
- dependency, container, workflow, or release supply-chain compromise;
- accidental publication of repository solutions or server-only material.

The visible and hidden exercise checks, assessment answers, scores, and timers are
delivered to the learner's browser. They are educational feedback, not secret,
proctored, or tamper-resistant assessment controls. A report that only demonstrates
that a learner can inspect or modify their own client-side assessment state is
therefore out of scope unless it crosses an account, server, or data boundary.

## Coordinated disclosure and safe research

Please allow a reasonable remediation period before public disclosure. Good-faith
research that avoids privacy violations, data destruction, service disruption,
social engineering, automated high-volume testing, and access beyond the minimum
needed to demonstrate the issue will not be treated as malicious. This policy does
not authorize testing systems or accounts that you do not own.
