def to_celsius(t):
    return list(map(lambda x: round((x-32)*5/9,1),t))