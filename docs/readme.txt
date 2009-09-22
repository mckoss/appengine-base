AppEngine-Base Project

Copyright (c) Seattle Google Technology Users Group

Repository: http://github.com/mckoss/appengine-base

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

Goals

The goal of this project is to provide a simple-to-user starter application for new
App Engine projects.  Where possible, each of the facilities, below, is designed to
operate independently of the others and can be configured to be used or not as the
application author requires.

AppEngine-Base uses Django (1.1) and adds some simple facilities to support:

- Request object extensions
- Common global template variables
- Signed Cookie Support
- Unique IP and User Tracking
- Simple Global Variables peristed to datastore
- Versioned Memcaching
- Protected Views for signed in and administrative users
- JSON api handler (including cross-site support)
- JavaScript composition and minification
- Unit Testing framework (JavaScript and Python)
- Server-side profiling
- Atom Support
- Member Profiles
- Twitter Auth
- Facebook Connect
- Google Analytics Tracking
- Google Webmaster Tools Verification
- Content Reporting and Blocking (Spam/Adult)
- Application Admin Page
