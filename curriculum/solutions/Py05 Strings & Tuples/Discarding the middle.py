def discard_middle(s):
    if len(s) <= 3:
        return ""
    else:
        return s[0:2] + s[-2:]