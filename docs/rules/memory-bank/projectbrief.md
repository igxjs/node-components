# Project Brief: @igxjs/node-components

## Overview
`@igxjs/node-components` is a reusable component library for Node.js/Express.js applications, providing essential building blocks for enterprise-grade web applications.

## Core Objectives

### Primary Goal
Create a well-tested, production-ready collection of Node.js components that solve common enterprise application requirements:
- Session management (SSO integration)
- Authentication (session-based and token-based)
- Routing utilities
- Error handling
- Redis integration
- JWT token management
- Logging

### Target Audience
- Node.js developers building Express.js applications
- Teams requiring SSO integration with session/token authentication
- Projects needing standardized error handling and routing patterns
- Applications requiring Redis-backed session storage

## Project Scope

### In Scope
1. **Component Library Structure**
   - Modular, independent components
   - ES module format
   - TypeScript definitions included
   - Comprehensive documentation

2. **Core Components**
   - SessionManager (SSO with dual authentication modes)
   - JwtManager (encrypted JWT tokens)
   - RedisManager (connection management)
   - FlexRouter (flexible routing)
   - Logger (zero-dependency logging)
   - HTTP Handlers (standardized error handling)

3. **Quality Standards**
   - Comprehensive JSDoc documentation
   - Unit tests for all components
   - Production-ready error handling
   - Real-world usage examples

### Out of Scope
- Frontend components or UI libraries
- Database ORMs or query builders
- Full authentication systems (only SSO integration)
- Application-specific business logic

## Success Criteria

1. **Usability**
   - Clear, concise API
   - Minimal configuration required
   - Comprehensive documentation with examples

2. **Reliability**
   - Production-ready error handling
   - Test coverage for critical paths
   - Proper async/await patterns

3. **Maintainability**
   - Clean, readable code
   - Consistent patterns across components
   - Well-documented architecture decisions

4. **Distribution**
   - Published to npm as `@igxjs/node-components`
   - Semantic versioning
   - TypeScript support included

## Key Requirements

### Technical Requirements
- Node.js >= 18
- ES modules (type: "module")
- Express.js compatible
- Optional Redis integration
- TypeScript definitions

### Code Quality Requirements
- JSDoc documentation for all public APIs
- Consistent naming conventions (SCREAMING_SNAKE_CASE for config, camelCase for methods)
- Component-based architecture
- Singleton pattern for manager classes
- Async/await throughout

### Distribution Requirements
- npm package with public access
- Includes: components/, docs/, TypeScript definitions
- Excludes: tests/, development files
- Apache 2.0 license

## Non-Goals
- This is not a full-stack framework
- Not responsible for frontend rendering
- Not a replacement for Express.js (it extends it)
- Not an opinionated application structure enforcer