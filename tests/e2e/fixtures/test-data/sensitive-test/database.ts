// Database connection strings
const DB_CONNECTION = {
  // PostgreSQL connection
  postgres: "postgresql://admin:secret_password_123@db.example.com:5432/production",
  // MySQL connection  
  mysql: "mysql://root:another_password@mysql.example.com:3306/mydb",
  // MongoDB connection
  mongodb: "mongodb+srv://mongouser:mongopass@cluster.mongodb.net/test?retryWrites=true",
  // Redis connection
  redis: "redis://:redispass@redis.example.com:6379/0",
};

export default DB_CONNECTION;
