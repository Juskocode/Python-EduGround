from math import factorial


def pascal(n):
    answer = ""
    for i in range(n):
        for j in range(i + 1):
            answer += str(factorial(i) // (factorial(j) * factorial(i - j))) + " "
        answer = answer.strip() + "\n"
    return answer