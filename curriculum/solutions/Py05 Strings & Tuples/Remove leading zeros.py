def remove_leading(ip):
    ip = ip.split('.')
    for counter1, element in enumerate(ip):
        for counter2, char in enumerate(element):
            if char != "0":
                ip[counter1] = element[counter2:]
                break
            elif counter2 == len(element) - 1:
                ip[counter1] = element[counter2:]
    ip = ".".join(ip)
    return ip