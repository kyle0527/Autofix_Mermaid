// 單元測試：Python IR 分析（Node.js 版）
const { parsePythonProject } = require('../dist/index');

function test_simple_class() {
    const files = {
        'mod1.py': `
class A:
    def foo(self):
        pass
class B(A):
    def bar(self):
        self.foo()
`
    };
    const ir = parsePythonProject(files);
    if (!ir.modules['mod1']) throw new Error('mod1 not found');
    const mod = ir.modules['mod1'];
    if (!mod.classes.some(c => c.name === 'A')) throw new Error('Class A not found');
    if (!mod.classes.some(c => c.name === 'B')) throw new Error('Class B not found');
    if (!mod.functions.concat(mod.classes[0].methods).some(f => f.name === 'foo')) throw new Error('foo not found');
    if (!mod.functions.concat(mod.classes[1].methods).some(f => f.name === 'bar')) throw new Error('bar not found');
    if (!mod.classes[1].bases.includes('A')) throw new Error('B does not inherit A');
    if (!mod.classes[1].methods[0].calls.includes('self.foo')) throw new Error('bar does not call self.foo');
}

function test_simple_func() {
    const files = {
        'mod2.py': `
def hello():
    print("hi")
`
    };
    const ir = parsePythonProject(files);
    if (!ir.modules['mod2']) throw new Error('mod2 not found');
    const mod = ir.modules['mod2'];
    if (!mod.functions.some(f => f.name === 'hello')) throw new Error('hello not found');
    if (!mod.functions[0].calls.includes('print')) throw new Error('hello does not call print');
}

function runAll() {
    test_simple_class();
    test_simple_func();
    console.log('All Python IR tests passed.');
}

runAll();
