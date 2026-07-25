n = list(input())
looping_number = True
for i in range(len(n) - 1):
    if int(n[i + 1]) != (int(n[i]) + 1) % 10 and int(n[i + 1]) != int(n[i]) - 1:
        looping_number = False
    
if looping_number == False:
    print("Not a looping number")
else:
    print("Looping number")