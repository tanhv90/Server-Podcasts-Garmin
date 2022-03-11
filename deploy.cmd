call git commit -am %1
call git push heroku master 
heroku logs --tail
