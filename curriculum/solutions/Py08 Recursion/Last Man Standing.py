def last_man_standing(alist, step):
    if len(alist) == 1:
        return alist[0]
    alist = alist[((step % len(alist)) - 1):] + alist[:((step % len(alist)) - 1)]
    alist.pop(0)
    return last_man_standing(alist, step)