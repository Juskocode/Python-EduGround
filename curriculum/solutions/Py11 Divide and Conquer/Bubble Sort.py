def bubble_sort(alist):
    flag = False
    length = len(alist)
    while flag == False:
        flag = True
        for i in range(0, length - 1):
            if alist[i] > alist[i+1]:
                aux = alist[i]
                alist[i] = alist[i+1]
                alist[i+1] = aux
                flag = False
    return alist