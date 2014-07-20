#/usr/bin/env python
#read csv input in BOM format into mydatabase.db

import sys
import sqlite3

inputfile = sys.argv[1] #eg. karratha-201402.csv

print 'input file = ', inputfile

conn=sqlite3.connect('mydatabase.db')

curs=conn.cursor()


def add_bom_readings (tdate, mintemp, maxtemp, rainfall):
   curs.execute("INSERT OR IGNORE INTO bom values( (?), (?), (?), (?))", (tdate, mintemp, maxtemp, rainfall))

def get_bom(file):
    try:
        fileobj = open(file,'r')
        lines = fileobj.readlines()
        fileobj.close()
        for l in lines:
            #print l
            ss=l.split(',')  #extract fields from csv input string
            #print len(ss)
            if (len(ss)==22):
                td = ss[1]
                mintemp = ss[2]
                maxtemp = ss[3]
                rainfall = ss[4]
                #print 'for db', td, mintemp, maxtemp, rainfall
                if td!='"Date"': #ignore field header line
                        add_bom_readings( td, mintemp, maxtemp, rainfall)
            #else:
                #print 'head: ', ss
    except:
        return None


#add_bom_readings('2014-02-01',33.4, 44.4, 15)
get_bom(inputfile)

conn.commit()

#TODO print '\num all bom records = ', curs.execute("COUNT ");
#print '\nEntire database bom contents:\n'
#for row in curs.execute("SELECT * from bom"):
#    print row

conn.close()


