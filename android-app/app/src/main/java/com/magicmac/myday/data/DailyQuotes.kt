package com.magicmac.myday.data

import java.time.LocalDate

data class Quote(
    val text: String,
    val author: String
)

object DailyQuotes {
    private val quotes = listOf(
        Quote("The secret of getting ahead is getting started.", "Mark Twain"),
        Quote("A goal without a plan is just a wish.", "Antoine de Saint-Exupery"),
        Quote("Do or do not. There is no try.", "Yoda"),
        Quote("The way to get started is to quit talking and begin doing.", "Walt Disney"),
        Quote("Lost time is never found again.", "Benjamin Franklin"),
        Quote("Action is the foundational key to all success.", "Pablo Picasso"),
        Quote("It is not enough to be busy. The question is: what are we busy about?", "Henry David Thoreau"),
        Quote("Time is what we want most, but what we use worst.", "William Penn"),
        Quote("By failing to prepare, you are preparing to fail.", "Benjamin Franklin"),
        Quote("The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese Proverb"),
        Quote("You don't have to be great to start, but you have to start to be great.", "Zig Ziglar"),
        Quote("Well done is better than well said.", "Benjamin Franklin"),
        Quote("Productivity is never an accident. It is always the result of a commitment to excellence.", "Paul J. Meyer"),
        Quote("The only way to do great work is to love what you do.", "Steve Jobs"),
        Quote("Ordinary people think merely of spending time. Great people think of using it.", "Arthur Schopenhauer"),
        Quote("Don't wait. The time will never be just right.", "Napoleon Hill"),
        Quote("Either you run the day or the day runs you.", "Jim Rohn"),
        Quote("Your future is created by what you do today, not tomorrow.", "Robert Kiyosaki"),
        Quote("The shorter way to do many things is to do only one thing at a time.", "Mozart"),
        Quote("What gets measured gets managed.", "Peter Drucker"),
        Quote("Discipline is the bridge between goals and accomplishment.", "Jim Rohn"),
        Quote("Amateurs sit and wait for inspiration. The rest of us just get up and go to work.", "Stephen King"),
        Quote("Plans are nothing; planning is everything.", "Dwight D. Eisenhower"),
        Quote("Time is the most valuable thing a man can spend.", "Theophrastus"),
        Quote("Start where you are. Use what you have. Do what you can.", "Arthur Ashe"),
        Quote("Focus on being productive instead of busy.", "Tim Ferriss"),
        Quote("The key is not to prioritize what's on your schedule, but to schedule your priorities.", "Stephen Covey"),
        Quote("A year from now you may wish you had started today.", "Karen Lamb"),
        Quote("Until we can manage time, we can manage nothing else.", "Peter Drucker"),
        Quote("Done is better than perfect.", "Sheryl Sandberg"),
    )

    fun getTodaysQuote(): Quote {
        val dayKey = todayKey()
        val seed = dayKey.fold(0) { acc, ch -> acc * 31 + ch.code }
        val index = ((seed % quotes.size) + quotes.size) % quotes.size
        return quotes[index]
    }
}
