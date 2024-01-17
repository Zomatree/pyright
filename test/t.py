from typing import reveal_type, cast



class FooProtocol[T]:
    foo: T

def test[T, U](obj: T, value: U) -> T & FooProtocol[U]:
    ...

class A:
    pass

a = A()
modified_a = test(a, 1)
reveal_type(modified_a.foo)
