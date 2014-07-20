#!/usr/bin/python
import sys
import urllib2

print 'Argument List:', str(sys.argv)

#TODO some error checking on these, 0 is this program name
year=sys.argv[1]
month=sys.argv[2]

#TODO perhaps path for outputfile?
inputfile='http://www.bom.gov.au/climate/dwo/'+year+month+'/text/IDCJDW6064.'+year+month+'.csv'
outputfile='karratha-'+year+month+'.csv'

print 'From file = ', inputfile
print 'To file = ', outputfile

contents = urllib2.urlopen(inputfile).readlines()  #or read(20000) read only 20 000 chars

fo = open(outputfile, "w")

for line in contents:
    #print "writing %s to a file" %(line,)
    fo.write(line)#write lines from url file to text file

fo.write('\n'); #final line
fo.close()#close text file

#all done
