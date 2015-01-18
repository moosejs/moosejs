#!/bin/bash

########################################
#			This is the script file responsible for compiling the source code
#			- It takes 3 arguments
#					1. The compiler to be used in the compilation
#					2. The source file to be compiled
#					3. Additionals arguments for the compiler
#
#			Sample execution: 			$: ./compile.sh g++ file.cpp -O2
#
########################################

compiler=$1
file=$2
addArg=$3

exec 2> >(tee compilation.error)

START=$(date +%s.%2N)

$compiler $file $addArg
if [ $? -eq 0 ];	then
	echo "Compilation succeeded" > "compilation.log"
	code=0
else
	echo "Compilation failed" > "compilation.log"
	code=1
fi

END=$(date +%s.%2N)

runtime=$(echo "$END - $START" | bc)

echo "Compilation time $runtime s" 
echo "Compilation time $runtime s" >> 'compilation.log'

exit $code
