
"""
Unit Test: Python IR Analysis (Basic Classes/Functions/Calls/Inheritance)
"""
from index import parsePythonProject

def test_simple_class():
    files = {
        'mod1.py': (
            "class A:\n"
            "    def foo(self):\n"
            "        pass\n"
            "class B(A):\n"
            "    def bar(self):\n"
            "        self.foo()\n"
        )
    }
    ir = parsePythonProject(files)
    assert 'mod1.py' in ir['modules']
    mod = ir['modules']['mod1.py']
    # classes
    names = {c['name'] for c in mod['classes']}
    assert names == {'A', 'B'}
    # methods
    b = [c for c in mod['classes'] if c['name'] == 'B'][0]
    mnames = {m['name'] for m in b['methods']}
    assert 'bar' in mnames

def test_simple_func():
    files = {
        'mod2.py': (
            "def hello():\n"
            "    print(\"hi\")\n"
        )
    }
    ir = parsePythonProject(files)
    mod = ir['modules']['mod2.py']
    assert any(f['name'] == 'hello' for f in mod['functions'])
    f = [f for f in mod['functions'] if f['name'] == 'hello'][0]
    assert 'print' in f['calls']

if __name__ == '__main__':
    test_simple_class()
    test_simple_func()
    print('All Python IR tests passed.')
