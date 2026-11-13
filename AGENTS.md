# ULTIMATE repository instructions

The Milestone Shop and the ULTIMATE OUTDOOR STORE are separate business systems. Keep catalogs, rules, redemption or order flows, payments, and fulfillment separate. Supabase, authentication, and neutral reusable components may be shared. Gelato and payment configuration belong to the Outdoor Store.

Both systems use one production Vercel project. Work from the current production deployment, preserve files and settings outside the approved change, and coordinate a single production promotion at a time. Follow [the shared release process](docs/production-release.md) for any production promotion. If the live deployment changes during a build, compare it and rebuild from the new baseline before promoting. Never assume that a release for one shop can replace the other shop's code or configuration.
