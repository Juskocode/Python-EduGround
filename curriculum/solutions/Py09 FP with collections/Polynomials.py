def evaluate(a, x):
    return sum(map(lambda element: element[1]*x**element[0], enumerate(a)))