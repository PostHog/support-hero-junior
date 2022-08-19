import { AllMiddlewareArgs, App, SlashCommand } from "@slack/bolt";
import axios from "axios";
import "dotenv/config";

const PORT = process.env.PORT || 3000;
const {
  SLACK_OAUTH_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  PAGERDUTY_API_TOKEN,
  PAGERDUTY_SUPPORT_HERO_SCHEDULE_ID = "PPLGE4G",
} = process.env;

const app = new App({
  token: SLACK_OAUTH_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: SLACK_APP_TOKEN,
  customRoutes: [
    {
      path: "/",
      method: ["GET"],
      handler: (req, res) => {
        res.writeHead(200);
        res.end("");
      },
    },
  ],
});

const disabledUserIds: string[] = [];

const defaultSupportHero = { slackName: "", timezone: "" };
let supportHero = { ...defaultSupportHero };

/*
params are username (ex @kevinoconnell42@gmail.com) and timezone (ex. America/New_York)
@returns whispered message to user giving the name of the new support hero.
*/

const cmdSupportHero = async (
  command: SlashCommand,
  client: AllMiddlewareArgs["client"]
) => {
  const res = await axios.get(
    `https://api.pagerduty.com/schedules/${PAGERDUTY_SUPPORT_HERO_SCHEDULE_ID}/users`,
    {
      headers: {
        Authorization: `${PAGERDUTY_API_TOKEN}`,
      },
    }
  );

  console.log(res.data);

  const id: string = command.user_id;
  const commandParam = command.text.trim().split(" ");

  let supportHero = {
    slackName: `<${commandParam[0]}>`,
    timezone: commandParam[1] ? commandParam[1] : "",
  };

  await client.chat.postEphemeral({
    channel: command.channel_id,
    user: id,
    text: `Support Hero is now ${supportHero.slackName} in ${supportHero.timezone}`,
  });
};

app.command("/supporthero", async ({ command, ack, client }) => {
  try {
    ack();

    await cmdSupportHero(command, client);
  } catch (error) {
    console.log("err");
    console.error(error);
  }
});
/*
@returns whispered message telling user the bot is disabled for them or that it is already disabled.
*/
app.command("/disable", async ({ command, ack, client }) => {
  try {
    ack();
    const id: string = command.user_id;
    let text = "";
    if (disabledUserIds.includes(id)) {
      text = "The bot is already disabled!";
    } else {
      disabledUserIds.push(id);
      text = "The bot is now disabled!";
    }
    const result = await client.chat.postEphemeral({
      channel: command.channel_id,
      user: id,
      text,
    });
  } catch (error) {
    console.log("err");
    console.error(error);
  }
});
/*
@returns whispered message telling user the bot is enabled for them or that it is already enabled.
*/
app.command("/enable", async ({ command, ack, client }) => {
  try {
    ack();
    const id: string = command.user_id;
    let text = "";
    const userIdIndex: number = disabledUserIds.findIndex(
      (value) => value == id
    );
    if (userIdIndex !== -1) {
      disabledUserIds.splice(userIdIndex, 1);
      text = "The bot is now enabled!";
    } else {
      text = "The bot is already enabled!";
    }
    const result = await client.chat.postEphemeral({
      channel: command.channel_id,
      user: id,
      text,
    });
  } catch (error) {
    console.log("err");
    console.error(error);
  }
});
/*
listener for events that occur in channels the bot is in
*/
app.event("message", async ({ message, client }) => {
  // Getting weird type error
  const finishedMessage = message as any;
  try {
    if (JSON.stringify(supportHero) === JSON.stringify(defaultSupportHero)) {
      const result = await client.chat.postEphemeral({
        channel: message.channel,
        user: finishedMessage.user,
        text: "You're asking the community for help. We recommend checking <https://posthog.com/questions|our support site> to see if your question has already been asked. There's no Support Hero currently available.",
      });
      return;
    } else if (!disabledUserIds.includes(finishedMessage.user)) {
      const msg = `You're asking the community for help. We recommend checking <https://posthog.com/questions|our support site> to see if your question has already been asked - but, if not, we'll respond <https://posthog.com/handbook/engineering/support-hero#prioritizing-requests|as quickly as we can>. Our Support Hero this week is ${supportHero.slackName}, based in ${supportHero.timezone}.`;
      const result = await client.chat.postEphemeral({
        channel: message.channel,
        user: finishedMessage.user,
        text: msg,
      });
      console.log(result);
    }
  } catch (error) {
    console.log("err");
    console.error(error);
  }
});

app.start(PORT);

console.log(`Listening on port ${PORT}...`);
