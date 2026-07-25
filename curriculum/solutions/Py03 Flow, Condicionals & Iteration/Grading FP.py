le  = int(input())
re  = int(input())
pe  = int(input())
te  = int(input())
if 0 < le > 100 or 0 < re > 100 or 0 < pe > 100 or 0 < te > 100:
    print("Input error")
elif pe < 40 or te < 40:
    print("RFF")
else:
    print(round((le + re + 13 * pe + 5 * te)/100))