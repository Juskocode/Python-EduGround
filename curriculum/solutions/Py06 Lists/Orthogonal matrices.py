def is_orthogonal(mx):
    transposed = [[mx[0][0], mx[1][0]], [mx[0][1], mx[1][1]]]
    calculated = [[mx[0][0] * transposed[0][0] + mx[0][1] * transposed[1][0], mx[0][0] * transposed[0][1] + mx[0][1] * transposed[1][1]], [mx[1][0] * transposed[0][0] + mx[1][1] * transposed[1][0], mx[1][0] * transposed[0][1] + mx[1][1] * transposed[1][1]]]
    if calculated == [[1, 0], [0,1]]:
        return True
    else:
        return False