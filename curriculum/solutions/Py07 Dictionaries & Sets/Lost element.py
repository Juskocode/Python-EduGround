def lost_element(s1, s2):
    return list(s1.union(s2) - s1.intersection(s2))[0]