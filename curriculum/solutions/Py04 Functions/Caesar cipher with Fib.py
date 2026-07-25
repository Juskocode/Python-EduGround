from math import sqrt


def caesar(message):
    answer = ""
    counter = 0
    for char in message:
        fibonacci = int(((1 + sqrt(5))**counter - (1 - sqrt(5))**counter) // (2**counter * sqrt(5)))
        if char.isalpha():
            answer += shift(char, fibonacci)
        else:
            answer += char
        counter += 1
    return answer


def shift(character, number):
    return (chr((ord(character) - number -65) % 26 + 65))