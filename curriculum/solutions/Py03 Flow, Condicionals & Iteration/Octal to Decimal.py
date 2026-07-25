n = list(input())
counter = len(n)
result = 0
error = False
for i in n:
    if 8 <= int(i):
        error = True
    result += int(i) * 8 ** (counter - 1)
    counter -= 1
if error == False:
    print(result)
else:
    print("Not a valid number.")