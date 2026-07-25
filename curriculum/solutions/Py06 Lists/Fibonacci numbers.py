def fib(n):
    if n == 1:
        return [0]
    else:
        result = [0, 1]
        for i in range(2, n):
            result.append(result[i - 2] + result[i - 1])
        return result