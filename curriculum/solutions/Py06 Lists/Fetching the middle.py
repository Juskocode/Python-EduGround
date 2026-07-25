def fetch_middle(llists):
    result = []
    for list in llists:
        if len(list)%2 == 0:
            average = (list[int(len(list)/2 - 1)]  + list[int(len(list)/2)])/2
            result.append(average)
        else:
            result.append(int(list[int(len(list)/2)]))
    return result