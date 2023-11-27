const fs = require('fs')
const path = require('path')
const babylon = require('babylon')
const traverse = require('babel-traverse').default
const { transformFromAst } = require('babel-core')

// 每一个JS文件对应一个id
let ID = 0


function createAsset(filename){
  const content = fs.readFileSync(filename, 'utf-8')
  // console.log(content)
  // 将文件中的内容转化为ast语法树
  const ast = babylon.parse(content, {
    sourceType: "module"
  })
  // 收集文件的依赖关系，也就是import的相关内容
  const dependencies = []
  traverse(ast, {
    ImportDeclaration: ({node}) => {
      // console.log(node)
      dependencies.push(node.source.value)
    }
  })
  const id = ID++
  const { code } = transformFromAst(ast, null, {
    // 使用babel-preset-env将代码转化为e s5，这里需要安装这个包 yarn add babel-preset-env
    presets: ['env']
  })
  return {
    id,
    filename,
    dependencies,
    code
  }
}


// 根据entry查找依赖
function createGraph(entry){
  const mainAsset = createAsset(entry)
  const queue = [mainAsset]
  for(const asset of queue){
    asset.mapping = {}
    // console.log(asset.filename)
    const dirname = path.dirname(asset.filename) //获取当前文件的目录，不包括文件名
    // console.log(dirname)
    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath)
      // console.log(absolutePath)
      // 再去解析
      const child = createAsset(absolutePath)
      asset.mapping[relativePath] = child.id
      queue.push(child)
    })
  }
  // console.log(queue)
  return queue
}

function bundle(graph) {
  console.log(graph)
  let modules = ''
  graph.forEach((mod) => {
    modules += `${mod.id}: [
      function(require, module, exports) {${mod.code}},
      ${ JSON.stringify(mod.mapping) },
    ],`;
  })
  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];
        function localRequire(name) {
          return require(mapping[name]);
        }
        const module = { exports: {} };
        fn(localRequire, module, module.exports);
        return module.exports;
      }
      require(0);
    })({${modules}})
  `

  // console.log(result)
  return result
}

const graph = createGraph("./example/entry.js")
const result = bundle(graph)

// 创建dist目录，将打包的内容写入main.js中
fs.mkdir('dist', (err) => {
  if (!err)
    fs.writeFile('dist/main.js', result, (err1) => {
      if (!err1) console.log('打包成功');
    });
});