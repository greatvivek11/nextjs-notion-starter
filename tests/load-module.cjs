const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { transformSync } = require('esbuild')

function loadFile(filename, dependencies, loader) {
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.require = (name) =>
    Object.hasOwn(dependencies, name) ? dependencies[name] : require(name)
  loaded._compile(
    transformSync(fs.readFileSync(filename, 'utf8'), {
      loader,
      jsx: 'automatic',
      format: 'cjs',
      target: 'es2022',
      sourcefile: filename
    }).code,
    filename
  )
  return loaded.exports
}

function loadModule(name, dependencies = {}) {
  return loadFile(
    path.resolve(__dirname, '../src/lib', `${name}.ts`),
    dependencies,
    'ts'
  )
}

function loadComponent(name, dependencies = {}) {
  return loadFile(
    path.resolve(__dirname, '../src/components', `${name}.tsx`),
    dependencies,
    'tsx'
  )
}

module.exports = { loadModule, loadComponent }
