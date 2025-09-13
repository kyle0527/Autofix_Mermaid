"""
Unit Test: Python IR Analysis (Basic Classes/Functions/Calls/Inheritance)
"""
import sys
sys.path.insert(0, '../../src')
from index import parsePythonProject

def test_simple_class():
    files = {
        'mod1.py': '''
class A:
    def foo(self):
        pass
class B(A):
    def bar(self):
        self.foo()
'''
    }
    ir = parsePythonProject(files)
    assert 'mod1' in ir['modules']
    mod = ir['modules']['mod1']
    assert any(c['name'] == 'A' for c in mod['classes'])
    assert any(c['name'] == 'B' for c in mod['classes'])
    assert any(f['name'] == 'foo' for f in mod['functions'] + mod['classes'][0]['methods'])
    assert any(f['name'] == 'bar' for f in mod['functions'] + mod['classes'][1]['methods'])
    # 檢查繼承
    assert 'A' in mod['classes'][1]['bases']
    # 檢查呼叫
    assert 'self.foo' in mod['classes'][1]['methods'][0]['calls']

def test_simple_func():
    files = {
        'mod2.py': '''
def hello():
    print("hi")
'''
    }
    ir = parsePythonProject(files)
    assert 'mod2' in ir['modules']
    mod = ir['modules']['mod2']
    assert any(f['name'] == 'hello' for f in mod['functions'])
    assert 'print' in mod['functions'][0]['calls']

if __name__ == '__main__':
    test_simple_class()
    test_simple_func()
    print('All Python IR tests passed.')
