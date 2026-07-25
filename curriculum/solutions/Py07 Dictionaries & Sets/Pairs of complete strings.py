def complete_pairs(s1, s2):
    result = []
    for element1 in s1:
        for element2 in s2:
            string = element1 + element2
            set_string = set(string)
            if len(set_string) == 26:
                result.append(string)
    return set(result)