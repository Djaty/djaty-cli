# Djaty Cli

# Installation
- `$ npm install -g @djaty/djaty-cli`

## SourceMap files
Upload sourcemap files to allow Djaty to de-obfuscate your JavaScript stack traces

This lets you view source code context obtained from stack traces in their original untransformed form, which is particularly useful for debugging minified code (e.g. UglifyJS), or transpiled code from a higher-level language (e.g. TypeScript, ...).

### Uploading sourcemap
`djaty-cli uploadSourcemap [options]`
- **--api-key**: An API key for project.
- **--api-secret**: An API secret for project.
- **--release**: when requesting to resolve a stack trace, we check the bug release against current uploaded releases and if a release is matched, the stack trace will be resolved. So, if a bug is not configured with a release, it'll not be able to have its stack trace resolved. And due to the probability of having multiple devices running different releases concurrently, we let the user upload up to 5 releases per project.
- **--minified-dir**: Path to the directory that contains the minified and sourcemap files (I.e, `dist`). Only `.js` and `.map` files will be uploaded.
- **--project-root**: The path of the project root. It helps us locate the original files from the stack frame, e.g., http://example.com.
- **--end-point**: The server URL The default is `djaty.com` (on-premises installations).

#### Example 
```
$ djaty-cli uploadSourcemap --api-key <project-api-key> \
--api-secret <project-api-secret> --release <release> --minified-dir <dir-path> \
--project-root https://your-domain.com
```

### Development
- `$ npm install`
- `$ npm start`

#### Developer notes:
- We should add all dependencies and devDependencies in package.json as dependencies to be able to build the cli after installation.
