const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const dbPath = path.join(__dirname, 'twitterClone.db')
const app = express()
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    response.send('Internal Server Error')
  }
}
initializeDBAndServer()

//Middleware Function to validate the user
const authenticateUser = async (request, response, next) => {
  try {
    let jwtToken
    const authHeader = request.headers['authorization']
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(' ')[1]
    }
    if (jwtToken === undefined) {
      response.status(401).send('Invalid JWT Token')
    } else {
      jwt.verify(jwtToken, 'CASPER', async (error, payload) => {
        if (error) {
          response.status(401).send('Invalid JWT Token')
        } else {
          const getUserId = `
          SELECT 
          user_id
          FROM 
          user
          WHERE
          username = ?
        `
          const userID = await db.get(getUserId, [payload])
          request.user_id = userID
          next()
        }
      })
    }
  } catch (e) {
    console.log(e.message)
    response.send('Internal Server Error')
  }
}

//API 1
app.post('/register/', async (request, response) => {
  try {
    const {username, password, name, gender} = request.body
    const getUserQuery = `
      SELECT 
      *
      FROM
      user
      WHERE 
      username = ?
    `
    const userDetails = await db.get(getUserQuery, [username])
    if (userDetails !== undefined) {
      response.status(400).send('User already exists')
    } else {
      if (password.length < 6) {
        response.status(400).send('Password is too short')
      } else {
        const createUserQuery = `
          INSERT INTO 
          user(name, username, password, gender)
          VALUES(?,?,?,?)
        `
        const hashedPassword = await bcrypt.hash(password, 10)
        await db.run(createUserQuery, [name, username, hashedPassword, gender])
        response.status(200).send('User created successfully')
      }
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 2
/*app.post('/login/', async (request, response) => {
  try {
    const {username, password} = request.body
    const getUserQuery = `
      SELECT 
      *
      FROM
      user
      WHERE
      username = ?
    `
    const getUser = await db.get(getUserQuery, [username])
    if (getUser === undefined) {
      response.status(400).send('Invalid user')
    } else {
      const isPasswordMatched = bcrypt.compare(password, getUser.password)
      if (isPasswordMatched === false) {
        response.status(400).send('Invalid password')
      } else {
        const jwtToken = jwt.sign(username, 'CASPER')
        response.send({jwtToken})
      }
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})*/
// API 2: Login to the system
app.post('/login/', async (request, response) => {
  try {
    const {username, password} = request.body

    // SQL query to retrieve user details based on username
    const getUserQuery = `
      SELECT 
        *
      FROM
        user
      WHERE
        username = ?
    `

    // Execute the query to get the user details
    const user = await db.get(getUserQuery, [username])

    // Check if the user exists
    if (user === undefined) {
      response.status(400).send('Invalid user')
    } else {
      // Compare the provided password with the hashed password stored in the database
      const isPasswordMatched = await bcrypt.compare(password, user.password)
      if (isPasswordMatched === false) {
        response.status(400).send('Invalid password')
      } else {
        // If the password is correct, generate a JWT token
        const jwtToken = jwt.sign({user_id: user.user_id}, 'CASPER')
        response.send({jwtToken})
      }
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 3
/*app.get('/user/tweets/feed/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request
    const getFollowingUsersIDQuery = `
      SELECT
      following_user_id
      FROM 
      follower
      WHERE 
      follower_user_id = ?
    `
    const followingUsersList = await db.all(getFollowingUsersIDQuery, [user_id])
    let userTweets = []
    for (let user of followingUsersList) {
      const getUserTweetsQuery = `
        SELECT 
        user.username,
        tweet.tweet,
        tweet.date_time AS dateTime
        FROM 
        user INNER JOIN tweet ON user.user_id = tweet.user_id
        WHERE 
        user.user_id = ?
        ORDER BY 
        date_time
        LIMIT 4
      `
      const userTweet = await db.get(getUserTweetsQuery, [
        user.following_user_id,
      ])
      userTweets.push(userTweet)
    }
    response.send(userTweets)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})*/
// API 3: Get the latest tweets of people whom the user follows
app.get('/user/tweets/feed/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request

    // SQL query to retrieve the latest tweets of people whom the user follows
    const getFollowingUsersTweetsQuery = `
      SELECT 
        user.username,
        tweet.tweet,
        tweet.date_time AS dateTime
      FROM 
        user 
      INNER JOIN 
        tweet ON user.user_id = tweet.user_id
      WHERE 
        user.user_id IN (
          SELECT 
            following_user_id 
          FROM 
            follower 
          WHERE 
            follower_user_id = ?
        )
      ORDER BY 
        tweet.date_time DESC
      LIMIT 4
    `

    // Execute the query to get the latest tweets
    const tweets = await db.all(getFollowingUsersTweetsQuery, [user_id])

    // Send the tweets in the response
    response.send(tweets)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 4
/*app.get('/user/following/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request
    const getFollowingUserIDQuery = `
      SELECT 
      following_user_id
      FROM
      follower
      WHERE 
      follower_user_id = ?
    `
    const followingUsersList = await db.all(getFollowingUserIDQuery, [user_id])
    let userNameList = []
    for (let user of followingUsersList) {
      const getUserNameQuery = `
        SELECT 
        name
        FROM 
        user
        WHERE
        user_id ?
      `
      const userName = await db.get(getUserNameQuery, [user.following_user_id])
      userNameList.push(userName)
    }
    response.send(userNameList)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})*/
// API 4: Get the list of all names of people who follow the user
app.get('/user/followers/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request

    // SQL query to retrieve the names of people who follow the user
    const getFollowerNamesQuery = `
      SELECT 
        user.name
      FROM 
        user 
      INNER JOIN 
        follower ON user.user_id = follower.follower_user_id
      WHERE 
        follower.following_user_id = ?
    `

    // Execute the query to get the list of follower names
    const followerNames = await db.all(getFollowerNamesQuery, [user_id])

    // Send the list of follower names in the response
    response.send(followerNames)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 5
/*app.get('/user/followers/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request
    const getFollowerUsersQuery = `
      SELECT 
      follower_user_id
      FROM 
      follower
      WHERE
      following_user_id = ?
    `
    const followerUsersList = await db.all(getFollowerUsersQuery, [user_id])
    let followersNameList = []
    for (let user of followerUsersList) {
      const getFollowerUserNameQuery = `
        SELECT
        name
        FROM 
        user
        WHERE
        user_id = ?
      `
      const userName = await db.get(getFollowerUserNameQuery, [
        user.follower_user_id,
      ])
      followersNameList.push(userName)
    }
    response.send(followersNameList)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})*/
// API 5: Get the list of all names of people whom the user follows
app.get('/user/following/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request

    // SQL query to retrieve the names of people whom the user follows
    const getFollowingNamesQuery = `
      SELECT 
        user.name
      FROM 
        user 
      INNER JOIN 
        follower ON user.user_id = follower.following_user_id
      WHERE 
        follower.follower_user_id = ?
    `

    // Execute the query to get the list of following names
    const followingNames = await db.all(getFollowingNamesQuery, [user_id])

    // Send the list of following names in the response
    response.send(followingNames)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 6
/*app.get('/tweets/:tweetId/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request
    const {tweetId} = request.params
    const getUserFollowingUsersIdQuery = `
      SELECT 
      following_user_id
      FROM
      follower
      WHERE
      follower_user_id = ?
    `
    const userFollowingUsersIDListResponse = await db.all(
      getUserFollowingUsersIdQuery,
      [user_id],
    )
    let userFollowingUsersIDList = []
    for (let user of userFollowingUsersIDListResponse) {
      userFollowingUsersIDList.push(user.following_user_id)
    }
    //console.log(userFollowingUsersIDList)
    const getTweetedUserIDQuery = `
      SELECT
      user_id
      FROM 
      tweet
      WHERE
      tweet_id = ?
    `
    const tweetedUser = await db.get(getTweetedUserIDQuery, [tweetId])
    //console.log(tweetedUser)
    //console.log(userFollowingUsersIDList.includes(tweetedUser.user_id))
    if (tweetedUser !== undefined) {
      if (userFollowingUsersIDList.includes(tweetedUser.user_id) === false) {
        response.status(401).send('Invalid Request')
      } else {
        const getTweetsOfUserQuery = `
          SELECT 
          tweet.tweet,
          COUNT(like.like_id) AS likes,
          reply.reply,
          tweet.date_time AS dateTime
          FROM 
          tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
          LEFT JOIN like ON tweet.tweet_id = like.tweet_id
          WHERE 
          tweet.tweet_id = ?
          GROUP BY 
          tweet.tweet_id
        `
        const userTweet = await db.get(getTweetsOfUserQuery, [tweetId])
        response.send(userTweet)
      }
    } else {
      response.status(400).send('Invalid Tweet ID')
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})*/
// API 6: Get details of a tweet
app.get('/tweets/:tweetId/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request
    const {tweetId} = request.params

    // Query to check if the user is following the owner of the tweet
    const isFollowingQuery = `
      SELECT 
        COUNT(*) AS count
      FROM 
        follower
      WHERE 
        follower_user_id = ? AND following_user_id = (
          SELECT 
            user_id
          FROM 
            tweet
          WHERE 
            tweet_id = ?
        )
    `

    // Execute the query to check if the user is following the owner of the tweet
    const isFollowing = await db.get(isFollowingQuery, [user_id, tweetId])

    // If the user is not following the owner of the tweet
    if (!isFollowing.count) {
      response.status(401).send('Invalid Request')
    } else {
      // Query to get tweet details including likes and replies count
      const getTweetDetailsQuery = `
        SELECT 
          tweet.tweet,
          COUNT(like.like_id) AS likes,
          COUNT(reply.reply_id) AS replies,
          tweet.date_time AS dateTime
        FROM 
          tweet 
        LEFT JOIN 
          like ON tweet.tweet_id = like.tweet_id
        LEFT JOIN 
          reply ON tweet.tweet_id = reply.tweet_id
        WHERE 
          tweet.tweet_id = ?
        GROUP BY 
          tweet.tweet_id
      `

      // Execute the query to get tweet details
      const tweetDetails = await db.get(getTweetDetailsQuery, [tweetId])

      // If the tweet exists, send the tweet details
      if (tweetDetails) {
        response.send(tweetDetails)
      } else {
        response.status(400).send('Invalid Tweet ID')
      }
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 7
/*app.get(
  '/tweets/:tweetId/likes/',
  authenticateUser,
  async (request, response) => {
    try {
      const {user_id} = request
      const {tweetId} = request.params
      const getUserFollowingUsersQuery = `
        SELECT
        following_user_id
        FROM 
        follower
        WHERE
        follower_user_id = ?
      `
      const userFollowingUsersList = await db.all(getUserFollowingUsersQuery, [
        user_id,
      ])
      let userFollowingUsersIDList = []
      for (let user of userFollowingUsersList) {
        userFollowingUsersIDList.push(user.following_user_id)
      }
      const getTweetedUserQuery = `
        SELECT 
        user_id
        FROM 
        tweet
        WHERE
        tweet_id = ?
      `
      const tweetedUserID = await db.get(getTweetedUserQuery, [tweetId])
      if (tweetedUserID !== undefined) {
        if (
          userFollowingUsersIDList.includes(tweetedUserID.user_id) === false
        ) {
          response.status(401).send('Invalid Request')
        } else {
          const getUserIDWhoLikedTweetQuery = `
            SELECT
            user_id
            FROM
            like
            WHERE
            tweet_id = ?
          `
          const userIDWhoLikedTweet = await db.all(
            getUserIDWhoLikedTweetQuery,
            [tweetId],
          )
          let userNamesList = []
          for (let user of userIDWhoLikedTweet) {
            let getUserNameQuery = `
              SELECT 
              username
              FROM
              user
              WHERE
              user_id = ?
            `
            let userName = await db.get(getUserNameQuery, [user.user_id])
            userNamesList.push(userName)
          }
          response.send({
            likes: userNamesList,
          })
        }
      } else {
        response.status(400).send('Invalid Tweet ID')
      }
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)*/
// API 7: Get likes of a tweet
app.get(
  '/tweets/:tweetId/likes/',
  authenticateUser,
  async (request, response) => {
    try {
      const {user_id} = request
      const {tweetId} = request.params

      // Query to fetch the list of users who liked the tweet
      const getLikesQuery = `
      SELECT 
        user.username
      FROM 
        user 
      INNER JOIN 
        like ON user.user_id = like.user_id
      WHERE 
        like.tweet_id = ?
    `

      // Execute the query to get likes
      const likes = await db.all(getLikesQuery, [tweetId])

      // Query to check if the user is following the owner of the tweet
      const isFollowingQuery = `
      SELECT 
        COUNT(*) AS count
      FROM 
        follower
      WHERE 
        follower_user_id = ? AND following_user_id = (
          SELECT 
            user_id
          FROM 
            tweet
          WHERE 
            tweet_id = ?
        )
    `

      // Execute the query to check if the user is following the owner of the tweet
      const isFollowing = await db.get(isFollowingQuery, [user_id, tweetId])

      // If there are no likes or the user is not following the owner of the tweet
      if (!likes.length || !isFollowing.count) {
        response.status(401).send('Invalid Request')
      } else {
        // Send the list of usernames who liked the tweet
        const likedBy = likes.map(like => like.username)
        response.send({likes: likedBy})
      }
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)

//API 8
/*app.get(
  '/tweets/:tweetId/replies/',
  authenticateUser,
  async (request, response) => {
    try {
      const {user_id} = request
      const {tweetId} = request.params
      const getUserFollowingUsersIDQuery = `
        SELECT
        following_user_id
        FROM
        follower
        WHERE
        follower_user_id = ?
      `
      const userFollowingUsers = await db.all(getUserFollowingUsersIDQuery, [
        user_id,
      ])
      if (userFollowingUsers !== undefined) {
        let userFollowingUsersList = []
        for (let user of userFollowingUsers) {
          userFollowingUsersList.push(user.following_user_id)
        }
        if (userFollowingUsersList.includes(user_id) === false) {
          response.status(401).status('Invalid Request')
        } else {
          const getNameAndRepliesQuery = `
            SELECT
            user.name,
            reply.reply
            FROM
            user INNER JOIN reply ON user.user_id = reply.user_id
            WHERE
            reply.tweet_id = ?
            GROUP BY
            reply.tweet_id
          `
          const nameAndReply = await db.all(getNameAndRepliesQuery, [tweetId])
          response.send(nameAndReply)
        }
      } else {
        response.status(400).send('Invalid Tweet ID')
      }
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)*/
// API 8: Get replies to a tweet
app.get(
  '/tweets/:tweetId/replies/',
  authenticateUser,
  async (request, response) => {
    try {
      const {user_id} = request
      const {tweetId} = request.params

      // Query to fetch the list of replies to the tweet
      const getRepliesQuery = `
      SELECT 
        user.name,
        reply.reply
      FROM 
        user 
      INNER JOIN 
        reply ON user.user_id = reply.user_id
      WHERE 
        reply.tweet_id = ?
      GROUP BY 
        reply.reply_id
    `

      // Execute the query to get replies
      const replies = await db.all(getRepliesQuery, [tweetId])

      // If there are no replies or the user is not following the owner of the tweet
      if (!replies.length) {
        response.status(401).send('Invalid Request')
      } else {
        // Send the list of replies
        response.send({replies})
      }
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)

//API 9
app.get('/user/tweets/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request

    // Query to fetch all tweets of the user
    const getUserTweetsQuery = `
      SELECT 
        tweet.tweet,
        COUNT(DISTINCT like.like_id) AS likes,
        COUNT(DISTINCT reply.reply_id) AS replies,
        tweet.date_time AS dateTime
      FROM 
        tweet 
        LEFT JOIN like ON tweet.tweet_id = like.tweet_id
        LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
      WHERE 
        tweet.user_id = ?
      GROUP BY 
        tweet.tweet_id
    `

    // Execute the query
    const userTweets = await db.all(getUserTweetsQuery, [user_id])

    // Send the response
    response.send(userTweets)
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

// API 10: Create a tweet
app.post('/user/tweets/', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request
    const {tweet} = request.body

    // Check if the tweet is provided in the request
    if (!tweet) {
      response.status(400).send('Tweet content is required')
      return
    }

    // Insert the tweet into the database
    const createTweetQuery = `
      INSERT INTO tweet (tweet, user_id, date_time)
      VALUES (?, ?, datetime('now'))
    `
    await db.run(createTweetQuery, [tweet, user_id])

    // Send success response
    response.send('Tweet created successfully')
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

// API 11: Delete a tweet with a valid JWT token
app.delete('/tweets/:tweetId', authenticateUser, async (request, response) => {
  try {
    const {user_id} = request.user_id // Extract user_id from the authenticated user
    const {tweetId} = request.params // Extract tweetId from the request parameters

    // SQL query to check if the tweet exists and belongs to the authenticated user
    const checkTweetQuery = `
      SELECT *
      FROM tweet
      WHERE tweet_id = ? AND user_id = ?
    `

    // Execute the query to check the existence of the tweet
    const tweet = await db.get(checkTweetQuery, [tweetId, user_id])

    // If the tweet exists and belongs to the user, delete it
    if (tweet) {
      // SQL query to delete the tweet
      const deleteTweetQuery = `
        DELETE FROM tweet
        WHERE tweet_id = ?
      `

      // Execute the query to delete the tweet
      await db.run(deleteTweetQuery, [tweetId])

      // Ensure the tweet is removed from the database
      const checkDeletedTweetQuery = `
        SELECT *
        FROM tweet
        WHERE tweet_id = ?
      `

      const deletedTweet = await db.get(checkDeletedTweetQuery, [tweetId])

      if (!deletedTweet) {
        // Send a success message
        response.send('Tweet Removed')
      } else {
        response.status(500).send('Failed to delete tweet from the database')
      }
    } else {
      // If the tweet doesn't exist or doesn't belong to the user, send an error message
      response.status(401).send('Invalid Request')
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

module.exports = app
