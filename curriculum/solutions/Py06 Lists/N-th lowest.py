def nth_lowest(lnum, n):
    while len(lnum) > n - 1:
        max = lnum[0]
        max_position = 0
        for i, number in enumerate(lnum):
            if number > max:
                max = number
                max_position = i
        lnum.pop(max_position)
    return max