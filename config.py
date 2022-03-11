#! /Library/Frameworks/Python.framework/Versions/3.8/bin/python3.8
# -*- coding: utf-8 -*-

import os

ACTIVE_LOG = os.environ['ACTIVE_LOG']
if ACTIVE_LOG == None:
	ACTIVE_LOG = False
