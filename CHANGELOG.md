# 1.0.0 (2026-02-05)


### Features

* Initial implementation of ConnectWise Automate TypeScript client ([2cfd4a3](https://github.com/asachs01/node-connectwise-automate/commit/2cfd4a37e109ece6f960a78d4d872c93831edc95))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of the ConnectWise Automate TypeScript client library
- Support for both integrator and user authentication methods
- Full TypeScript type definitions for all API resources
- Resources: Computers, Clients, Locations, Contacts, Alerts, Scripts, Patches, Groups
- Automatic token management and refresh
- Rate limiting with configurable thresholds
- Automatic pagination support with async iterators
- Comprehensive error handling with typed exceptions
- Unit and integration tests using Vitest and MSW
- Semantic release for automated versioning
