class Person:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def greet(self) -> str:
        return f"Hello, my name is {self.name}"

class Student(Person):
    def __init__(self, name: str, age: int, student_id: str):
        super().__init__(name, age)
        self.student_id = student_id

    def study(self) -> str:
        return f"{self.name} is studying"