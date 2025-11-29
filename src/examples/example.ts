function greet(name: string) {
  console.log('Hello', name);
}

greet('World');
greet('Alice');
greet('Bob');

class Foo {
  method() {
    console.log('method');
  }
}

const f = new Foo();
f.method();
