from datetime import datetime, timedelta

hour_input = int(input("Hour = "))
minute_input = int(input("Minutes = "))

hour_and_minute = datetime(year=2022,month=10,day=6,hour=hour_input, minute=minute_input)
time_add = timedelta(hours=6, minutes=51)
hour_and_minute = hour_and_minute + time_add
hour_and_minute = datetime.strftime(hour_and_minute, '%H:%M')
print(hour_and_minute)