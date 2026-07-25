string = input("Text: ")
n = int(input("n = "))
for i in range(n - 1):
    print(f"{string}-", end="")
print(string)