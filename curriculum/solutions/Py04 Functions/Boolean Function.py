def validate(grade):
    try:
        return (0 <= grade and grade <= 100) * (type(grade) == float or type(grade) == int)
    except:
        return False