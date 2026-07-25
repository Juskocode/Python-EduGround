L = int(input())
S = int(input())
R = L
if R <= S:
    L = R
    R = S
    S = L
while True:
    while S <= R:
        R = R - S
    if R == 0:
        break
    else:
        L = R
        R = S
        S = L
print(S)